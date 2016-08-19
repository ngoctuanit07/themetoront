<?php

class Sns_Toronto_Model_System_Config_Source_ListColor
{
	public function toOptionArray()
	{
		return array(
			array('value'=>'red', 'label'=>Mage::helper('toronto')->__('Red')),
			array('value'=>'brown', 'label'=>Mage::helper('toronto')->__('Brown')),
			array('value'=>'purple', 'label'=>Mage::helper('toronto')->__('Purple')),
			array('value'=>'yellow', 'label'=>Mage::helper('toronto')->__('Yellow')),
			array('value'=>'blue', 'label'=>Mage::helper('toronto')->__('Blue')),
			array('value'=>'green', 'label'=>Mage::helper('toronto')->__('Green')),
			array('value'=>'chocolate', 'label'=>Mage::helper('toronto')->__('Chocolate')),
			array('value'=>'slateblue', 'label'=>Mage::helper('toronto')->__('Slateblue')),
		);
	}
}
